// Weather-Based Hydration Adjustment Edge Function
// Adjusts daily hydration targets based on weather conditions

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Hydration adjustment multipliers based on temperature (Celsius)
const TEMP_MULTIPLIERS: Record<string, number> = {
  'cold': 0.9,       // Below 10°C
  'cool': 1.0,       // 10-15°C
  'mild': 1.0,       // 15-20°C
  'warm': 1.15,      // 20-25°C
  'hot': 1.3,        // 25-30°C
  'very_hot': 1.5,   // Above 30°C
}

// Additional multiplier for humidity
const HUMIDITY_MULTIPLIERS: Record<string, number> = {
  'low': 1.0,        // Below 40%
  'medium': 1.05,    // 40-60%
  'high': 1.15,      // 60-80%
  'very_high': 1.25, // Above 80%
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('No authorization header')

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    )
    if (authError || !user) throw new Error('Unauthorized')

    const { latitude, longitude, date } = await req.json()
    const targetDate = date || new Date().toISOString().split('T')[0]

    // Fetch weather data from Open-Meteo API (free, no API key required)
    let weather = null
    if (latitude && longitude) {
      const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&daily=temperature_2m_max,temperature_2m_min,relative_humidity_2m_mean&timezone=auto&forecast_days=1`
      const weatherResponse = await fetch(weatherUrl)
      if (weatherResponse.ok) {
        weather = await weatherResponse.json()
      }
    }

    // Get user's base hydration target
    const { data: nutritionPlan } = await supabase
      .from('nutrition_plans')
      .select('base_hydration_ml')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single()

    const baseHydration = nutritionPlan?.base_hydration_ml || 2500

    // Get scheduled runs for today (intensity affects hydration needs)
    const { data: todayRuns } = await supabase
      .from('runs')
      .select('run_type, distance_km, duration_minutes')
      .eq('user_id', user.id)
      .eq('scheduled_date', targetDate)

    // Calculate adjustments
    let tempMultiplier = 1.0
    let humidityMultiplier = 1.0
    let tempCategory = 'mild'
    let humidityCategory = 'medium'
    let avgTemp = null
    let humidity = null

    if (weather?.daily) {
      const maxTemp = weather.daily.temperature_2m_max?.[0] || 20
      const minTemp = weather.daily.temperature_2m_min?.[0] || 15
      avgTemp = (maxTemp + minTemp) / 2
      humidity = weather.daily.relative_humidity_2m_mean?.[0] || 50

      // Determine temperature category
      if (avgTemp < 10) { tempCategory = 'cold'; tempMultiplier = TEMP_MULTIPLIERS.cold }
      else if (avgTemp < 15) { tempCategory = 'cool'; tempMultiplier = TEMP_MULTIPLIERS.cool }
      else if (avgTemp < 20) { tempCategory = 'mild'; tempMultiplier = TEMP_MULTIPLIERS.mild }
      else if (avgTemp < 25) { tempCategory = 'warm'; tempMultiplier = TEMP_MULTIPLIERS.warm }
      else if (avgTemp < 30) { tempCategory = 'hot'; tempMultiplier = TEMP_MULTIPLIERS.hot }
      else { tempCategory = 'very_hot'; tempMultiplier = TEMP_MULTIPLIERS.very_hot }

      // Determine humidity category
      if (humidity < 40) { humidityCategory = 'low'; humidityMultiplier = HUMIDITY_MULTIPLIERS.low }
      else if (humidity < 60) { humidityCategory = 'medium'; humidityMultiplier = HUMIDITY_MULTIPLIERS.medium }
      else if (humidity < 80) { humidityCategory = 'high'; humidityMultiplier = HUMIDITY_MULTIPLIERS.high }
      else { humidityCategory = 'very_high'; humidityMultiplier = HUMIDITY_MULTIPLIERS.very_high }
    }

    // Training intensity multiplier
    let trainingMultiplier = 1.0
    if (todayRuns && todayRuns.length > 0) {
      const intensityRuns = todayRuns.filter(r => 
        ['Tempo Run', 'Quality Run', 'Intervals', 'Race'].includes(r.run_type)
      )
      const longRuns = todayRuns.filter(r => r.run_type === 'Long Run')
      
      if (intensityRuns.length > 0) trainingMultiplier = 1.2
      if (longRuns.length > 0) trainingMultiplier = Math.max(trainingMultiplier, 1.3)
    }

    const totalMultiplier = tempMultiplier * humidityMultiplier * trainingMultiplier
    const adjustedHydration = Math.round(baseHydration * totalMultiplier)

    // Generate recommendations
    const recommendations: string[] = []
    if (tempMultiplier > 1.1) {
      recommendations.push(`Hot weather: Increase fluid intake and add electrolytes`)
    }
    if (humidityMultiplier > 1.1) {
      recommendations.push(`High humidity: You'll sweat more, stay ahead of hydration`)
    }
    if (trainingMultiplier > 1) {
      recommendations.push(`Training day: Pre-hydrate 2hrs before and rehydrate after`)
    }

    return new Response(
      JSON.stringify({
        date: targetDate,
        base_hydration_ml: baseHydration,
        adjusted_hydration_ml: adjustedHydration,
        weather: {
          temperature_c: avgTemp,
          humidity_percent: humidity,
          temp_category: tempCategory,
          humidity_category: humidityCategory,
        },
        multipliers: {
          temperature: tempMultiplier,
          humidity: humidityMultiplier,
          training: trainingMultiplier,
          total: totalMultiplier,
        },
        training: todayRuns || [],
        recommendations,
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

