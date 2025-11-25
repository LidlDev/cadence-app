// Supabase Edge Function for AI Run Insights
// Handles long-running AI insight generation without timeout constraints

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create Supabase client with user's auth token
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!

    // Extract JWT token from Authorization header
    const jwt = authHeader.replace('Bearer ', '')

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: authHeader },
      },
      auth: {
        persistSession: false,
      },
    })

    // Verify user
    const { data: { user }, error: userError } = await supabase.auth.getUser(jwt)
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized', details: userError?.message }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Parse request body
    const { runId } = await req.json()

    if (!runId) {
      return new Response(
        JSON.stringify({ error: 'Missing runId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get OpenAI API key
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY')
    if (!openaiApiKey) {
      return new Response(
        JSON.stringify({ error: 'AI service not configured' }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Fetch the run data
    const { data: run, error: runError } = await supabase
      .from('runs')
      .select('*')
      .eq('id', runId)
      .eq('user_id', user.id)
      .single()

    if (runError || !run) {
      return new Response(
        JSON.stringify({ error: 'Run not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // If insights already exist, return them
    if (run.ai_insights) {
      return new Response(
        JSON.stringify({ insights: run.ai_insights, cached: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Fetch user profile for context
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    // Fetch training plan for context
    const { data: trainingPlan } = await supabase
      .from('training_plans')
      .select('*')
      .eq('id', run.training_plan_id)
      .single()

    // Fetch recent runs for comparison
    const { data: recentRuns } = await supabase
      .from('runs')
      .select('*')
      .eq('user_id', user.id)
      .eq('completed', true)
      .order('scheduled_date', { ascending: false })
      .limit(10)

    // Fetch activity streams for granular data (pace, HR, cadence per meter)
    const { data: activityStreams } = await supabase
      .from('activity_streams')
      .select('*')
      .eq('run_id', runId)
      .eq('user_id', user.id)

    // Fetch heart rate zones
    const { data: hrZones } = await supabase
      .from('activity_heart_rate_zones')
      .select('*')
      .eq('run_id', runId)
      .eq('user_id', user.id)
      .single()

    // Build context for AI with granular data
    const context = buildRunContext(run, profile, trainingPlan, recentRuns || [], activityStreams || [], hrZones)

    // Generate insights using OpenAI
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are an enthusiastic and knowledgeable running coach analyzing a completed run with access to detailed performance data.

## Your Analysis Approach

**CRITICAL: Understand the run type before judging performance!**

### For Interval Runs:
- DO NOT judge based on average pace alone - these runs are SUPPOSED to have varied pacing
- Look at the "Planned Workout Structure" and "Detected hard effort segments"
- Evaluate if the hard efforts hit the target pace (even if average pace is slower)
- Check if the number of detected efforts matches the planned workout (e.g., 6x1km should show 6 efforts)
- Analyze interval consistency - are the paces similar across all intervals?
- Check for fading - did pace drop off in later intervals?
- Heart rate zones should show significant time in zones 4-5 during efforts
- Recovery between intervals is just as important as the hard efforts

### For Fartlek Runs:
- These are unstructured speed play - expect high pace variability
- Look for the planned structure (e.g., "2 on 2 off" means 2min hard, 2min easy)
- Evaluate if detected surges match the planned pattern
- The "on" portions should be significantly faster than average pace
- Don't penalize slower average pace - that's expected with recovery periods
- Check if they maintained quality throughout or faded
- Heart rate should spike during "on" portions and recover during "off" portions

### For Hill Repeats:
- Pace will be slower than flat running - this is NORMAL
- Look for repeated efforts in the pace data
- Elevation gain is a key metric - should be significant
- Heart rate zones 4-5 indicate proper effort
- Downhill recovery pace should be easy
- Consistency across repeats is important

### For Quality Run (Legacy):
- This is an older run type that has been replaced by Interval, Fartlek, and Hill Repeats
- Treat it as a general structured workout
- Look at the notes/description to understand the intended workout
- Apply appropriate analysis based on what the workout actually was

### For Easy/Recovery Runs:
- These should be SLOW - praise restraint if they kept it easy
- Check heart rate zones - should be mostly zone 1-2
- Consistent, controlled pace is the goal
- Going too fast on easy days is a common mistake

### For Tempo/Threshold Runs:
- Should maintain steady pace close to target
- Heart rate should be mostly zone 3-4
- Look for even pacing or slight negative split
- Cardiac drift analysis is important here

### For Long Runs:
- Endurance is key, not speed
- Look for pacing consistency and energy management
- Negative split is a great sign
- Check for cardiac drift (indicates fueling/hydration)

## Analysis Framework

1. **Run Type Context**: First identify what type of run this was and what success looks like
2. **Granular Data Analysis**: Use the meter-by-meter pace, heart rate, and cadence data to understand execution
3. **Target vs Actual**: Compare performance to target IN THE CONTEXT of the run type
4. **Physiological Response**: Analyze HR zones, cardiac drift, and effort distribution
5. **Pacing Strategy**: Evaluate splits, surges, and energy management
6. **Personal Notes**: If the runner shared feelings/observations, acknowledge and respond empathetically
7. **Actionable Insights**: Provide specific, practical recommendations

## Output Format

Use clear markdown sections:
- **🎯 Run Execution** - How well did they execute the planned workout?
- **📊 Performance Analysis** - What the data tells us
- **💪 Strengths** - What they did well
- **🔧 Areas for Improvement** - Constructive feedback
- **🚀 Next Steps** - Specific recommendations

Be energetic and motivating while being technically accurate. Use emojis sparingly but effectively.`
          },
          {
            role: 'user',
            content: context
          }
        ],
        temperature: 0.8,
        max_tokens: 1500,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json()
      console.error('OpenAI API error:', errorData)
      return new Response(
        JSON.stringify({ error: 'Failed to generate insights', details: errorData }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const completion = await response.json()
    const insights = completion.choices[0].message.content

    // Store insights in database
    await supabase
      .from('runs')
      .update({ ai_insights: insights })
      .eq('id', runId)

    return new Response(
      JSON.stringify({ insights, cached: false }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error: any) {
    console.error('Error generating run insights:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

function buildRunContext(run: any, profile: any, trainingPlan: any, recentRuns: any[], activityStreams: any[], hrZones: any): string {
  let context = `Analyze this completed run:\n\n`

  context += `## Run Details\n`
  context += `- Type: ${run.run_type}${run.session_type ? ` (${run.session_type})` : ''}\n`
  context += `- Week ${run.week_number} of training plan\n`
  context += `- Planned: ${run.planned_distance}km${run.target_pace ? ` at ${run.target_pace}/km` : ''}\n`
  context += `- Actual: ${run.actual_distance}km in ${run.actual_time}${run.actual_pace ? ` at ${run.actual_pace}/km` : ''}\n`

  if (run.average_hr) context += `- Average HR: ${run.average_hr} bpm${run.max_hr ? ` (Max: ${run.max_hr})` : ''}\n`
  if (run.average_cadence) context += `- Average Cadence: ${Math.round(run.average_cadence * 2)} spm\n`
  if (run.total_elevation_gain) context += `- Elevation Gain: ${run.total_elevation_gain}m\n`
  if (run.rpe) context += `- RPE: ${run.rpe}/10\n`
  if (run.notes) context += `\n**Coach's Notes:** ${run.notes}\n`
  if (run.strava_description) context += `\n**Runner's Personal Notes (from Strava):** "${run.strava_description}"\n`
  if (run.comments) context += `**Comments:** ${run.comments}\n`

  // Add heart rate zones if available
  if (hrZones) {
    context += `\n## Heart Rate Zone Distribution\n`
    const totalTime = (hrZones.zone_1_time || 0) + (hrZones.zone_2_time || 0) + (hrZones.zone_3_time || 0) + (hrZones.zone_4_time || 0) + (hrZones.zone_5_time || 0)
    if (totalTime > 0) {
      context += `- Zone 1 (Recovery): ${hrZones.zone_1_time}s (${Math.round(hrZones.zone_1_time / totalTime * 100)}%)\n`
      context += `- Zone 2 (Aerobic): ${hrZones.zone_2_time}s (${Math.round(hrZones.zone_2_time / totalTime * 100)}%)\n`
      context += `- Zone 3 (Tempo): ${hrZones.zone_3_time}s (${Math.round(hrZones.zone_3_time / totalTime * 100)}%)\n`
      context += `- Zone 4 (Threshold): ${hrZones.zone_4_time}s (${Math.round(hrZones.zone_4_time / totalTime * 100)}%)\n`
      context += `- Zone 5 (Max): ${hrZones.zone_5_time}s (${Math.round(hrZones.zone_5_time / totalTime * 100)}%)\n`
    }
  }

  // Add granular stream data analysis
  if (activityStreams && activityStreams.length > 0) {
    context += `\n## Granular Performance Data Available\n`

    // Analyze pace stream for intervals/fartlek detection
    const paceStream = activityStreams.find((s: any) => s.stream_type === 'velocity_smooth')
    if (paceStream && paceStream.data) {
      const velocities = paceStream.data as number[]
      context += analyzeGranularPace(velocities, run.run_type, run.session_type, run.notes, run.strava_description)
    }

    // Analyze heart rate stream
    const hrStream = activityStreams.find((s: any) => s.stream_type === 'heartrate')
    if (hrStream && hrStream.data) {
      const heartRates = hrStream.data as number[]
      context += analyzeGranularHeartRate(heartRates, profile?.max_heart_rate)
    }

    // Analyze cadence stream
    const cadenceStream = activityStreams.find((s: any) => s.stream_type === 'cadence')
    if (cadenceStream && cadenceStream.data) {
      const cadences = cadenceStream.data as number[]
      context += analyzeGranularCadence(cadences)
    }
  }

  if (trainingPlan) {
    context += `\n## Training Context\n`
    context += `- Plan: ${trainingPlan.name}\n`
    context += `- Goal: ${trainingPlan.goal_race || 'General fitness'}\n`
    if (trainingPlan.goal_time) context += `- Target Time: ${trainingPlan.goal_time}\n`
  }

  if (profile) {
    context += `\n## Runner Profile\n`
    if (profile.age) context += `- Age: ${profile.age}\n`
    if (profile.gender) context += `- Gender: ${profile.gender}\n`
    if (profile.max_heart_rate) context += `- Max HR: ${profile.max_heart_rate} bpm\n`
    if (profile.resting_heart_rate) context += `- Resting HR: ${profile.resting_heart_rate} bpm\n`
  }

  if (recentRuns && recentRuns.length > 0) {
    context += `\n## Recent Performance (Last ${recentRuns.length} runs)\n`
    recentRuns.slice(0, 5).forEach((r: any, i: number) => {
      context += `${i + 1}. ${r.run_type}: ${r.actual_distance}km in ${r.actual_time}`
      if (r.actual_pace) context += ` (${r.actual_pace}/km)`
      if (r.average_hr) context += ` - HR: ${r.average_hr}`
      context += `\n`
    })
  }

  return context
}

/**
 * Analyze granular pace data to detect intervals, surges, pacing strategy
 */
function analyzeGranularPace(velocities: number[], runType: string, sessionType: string | null, notes?: string, description?: string): string {
  if (velocities.length === 0) return ''

  let analysis = `\n### Pace Analysis (meter-by-meter)\n`

  // Convert m/s to min/km for each point
  const paces = velocities.map(v => v > 0 ? 1000 / (v * 60) : 0).filter(p => p > 0 && p < 20)

  if (paces.length === 0) return ''

  const avgPace = paces.reduce((a, b) => a + b, 0) / paces.length
  const minPace = Math.min(...paces)
  const maxPace = Math.max(...paces)
  const stdDev = Math.sqrt(paces.reduce((sq, n) => sq + Math.pow(n - avgPace, 2), 0) / paces.length)

  analysis += `- Pace Range: ${formatPace(minPace)} to ${formatPace(maxPace)} per km\n`
  analysis += `- Pace Variability: ${stdDev.toFixed(2)} min/km (${stdDev < 0.3 ? 'very consistent' : stdDev < 0.6 ? 'consistent' : stdDev < 1.0 ? 'moderate variation' : 'high variation'})\n`

  // Parse workout description from notes or description
  const workoutText = `${notes || ''} ${description || ''}`
  const workoutStructure = parseWorkoutDescription(workoutText)

  // Detect intervals/surges for structured workouts
  if (runType === 'Fartlek' || runType === 'Interval' || runType === 'Hill Repeats' ||
      runType.toLowerCase().includes('fartlek') || runType.toLowerCase().includes('interval') ||
      sessionType?.toLowerCase().includes('interval')) {

    const intervals = detectIntervals(paces, workoutStructure)

    if (workoutStructure) {
      analysis += `\n**Planned Workout Structure:**\n`
      if (workoutStructure.type === 'intervals' && workoutStructure.reps && workoutStructure.distance) {
        analysis += `- ${workoutStructure.reps} x ${workoutStructure.distance}m intervals\n`
      } else if (workoutStructure.type === 'fartlek' && workoutStructure.onTime && workoutStructure.offTime) {
        analysis += `- Fartlek: ${workoutStructure.onTime}s hard / ${workoutStructure.offTime}s easy\n`
      }
    }

    if (intervals.length > 0) {
      analysis += `\n**Detected ${intervals.length} hard effort segments:**\n`
      intervals.forEach((interval, i) => {
        analysis += `  ${i + 1}. ${formatPace(interval.avgPace)}/km for ${interval.duration}s`

        // Compare to planned structure if available
        if (workoutStructure?.type === 'intervals' && workoutStructure.reps) {
          if (i < workoutStructure.reps) {
            analysis += ` ✓`
          }
        } else if (workoutStructure?.type === 'fartlek' && workoutStructure.onTime) {
          const expectedDuration = workoutStructure.onTime
          const diff = Math.abs(interval.duration - expectedDuration)
          if (diff < 10) {
            analysis += ` ✓ (matches planned ${expectedDuration}s)`
          } else if (interval.duration < expectedDuration - 10) {
            analysis += ` ⚠️ (${expectedDuration - interval.duration}s shorter than planned)`
          }
        }
        analysis += `\n`
      })

      // Summary of interval quality
      if (workoutStructure?.reps && intervals.length !== workoutStructure.reps) {
        analysis += `\n⚠️ Detected ${intervals.length} efforts vs ${workoutStructure.reps} planned\n`
      }

      // Analyze consistency across intervals
      if (intervals.length >= 3) {
        const intervalPaces = intervals.map(i => i.avgPace)
        const intervalAvg = intervalPaces.reduce((a, b) => a + b, 0) / intervalPaces.length
        const intervalStdDev = Math.sqrt(intervalPaces.reduce((sq, n) => sq + Math.pow(n - intervalAvg, 2), 0) / intervalPaces.length)

        if (intervalStdDev < 0.1) {
          analysis += `- Interval Consistency: Excellent! (±${(intervalStdDev * 60).toFixed(0)}s variation)\n`
        } else if (intervalStdDev < 0.2) {
          analysis += `- Interval Consistency: Good (±${(intervalStdDev * 60).toFixed(0)}s variation)\n`
        } else {
          analysis += `- Interval Consistency: Variable (±${(intervalStdDev * 60).toFixed(0)}s variation) - work on even pacing\n`
        }

        // Check for fading
        const firstThird = intervalPaces.slice(0, Math.ceil(intervalPaces.length / 3))
        const lastThird = intervalPaces.slice(-Math.ceil(intervalPaces.length / 3))
        const firstAvg = firstThird.reduce((a, b) => a + b, 0) / firstThird.length
        const lastAvg = lastThird.reduce((a, b) => a + b, 0) / lastThird.length

        if (lastAvg > firstAvg + 0.15) {
          analysis += `- Fatigue Pattern: Slowed by ${formatPace(lastAvg - firstAvg)}/km in later intervals - consider easier start\n`
        } else if (lastAvg < firstAvg - 0.15) {
          analysis += `- Fatigue Pattern: Negative split! Got ${formatPace(firstAvg - lastAvg)}/km faster - excellent energy management!\n`
        } else {
          analysis += `- Fatigue Pattern: Maintained pace throughout - great execution!\n`
        }
      }
    } else {
      analysis += `\n⚠️ No distinct hard efforts detected in pace data. This may indicate:\n`
      analysis += `  - Workout was more tempo-paced than interval-based\n`
      analysis += `  - Intervals were not significantly faster than recovery pace\n`
      analysis += `  - GPS data quality issues\n`
    }
  } else {
    // For non-structured runs, analyze pacing strategy
    const firstHalfPace = paces.slice(0, Math.floor(paces.length / 2)).reduce((a, b) => a + b, 0) / Math.floor(paces.length / 2)
    const secondHalfPace = paces.slice(Math.floor(paces.length / 2)).reduce((a, b) => a + b, 0) / (paces.length - Math.floor(paces.length / 2))
    const paceDiff = secondHalfPace - firstHalfPace

    if (Math.abs(paceDiff) < 0.1) {
      analysis += `- Pacing Strategy: Even split (excellent pacing control)\n`
    } else if (paceDiff < 0) {
      analysis += `- Pacing Strategy: Negative split (${formatPace(Math.abs(paceDiff))}/km faster in 2nd half - great execution!)\n`
    } else {
      analysis += `- Pacing Strategy: Positive split (${formatPace(paceDiff)}/km slower in 2nd half - may have started too fast)\n`
    }
  }

  return analysis
}

/**
 * Parse workout description to extract structure
 * Examples: "6x1km", "8x400m", "2 on 2 off", "5x (3min hard, 2min easy)"
 */
function parseWorkoutDescription(description: string): {
  type: 'intervals' | 'fartlek' | 'unknown'
  reps?: number
  distance?: number
  onTime?: number
  offTime?: number
} | null {
  if (!description) return null

  const lower = description.toLowerCase()

  // Match patterns like "6x1km", "8x400m", "10 x 800"
  const intervalMatch = lower.match(/(\d+)\s*x\s*(\d+(?:\.\d+)?)\s*(km|k|m|meters?)?/)
  if (intervalMatch) {
    const reps = parseInt(intervalMatch[1])
    const distance = parseFloat(intervalMatch[2])
    const unit = intervalMatch[3]

    return {
      type: 'intervals',
      reps,
      distance: unit?.startsWith('k') ? distance * 1000 : distance
    }
  }

  // Match fartlek patterns like "2 on 2 off", "3min on 2min off", "90s hard 60s easy"
  const fartlekMatch = lower.match(/(\d+)\s*(min|mins?|minutes?|s|sec|seconds?)?\s*(on|hard|fast)\s*(\d+)\s*(min|mins?|minutes?|s|sec|seconds?)?\s*(off|easy|recovery)/)
  if (fartlekMatch) {
    const onValue = parseInt(fartlekMatch[1])
    const onUnit = fartlekMatch[2]
    const offValue = parseInt(fartlekMatch[4])
    const offUnit = fartlekMatch[5]

    // Convert to seconds
    const onTime = onUnit?.startsWith('m') ? onValue * 60 : onValue
    const offTime = offUnit?.startsWith('m') ? offValue * 60 : offValue

    return {
      type: 'fartlek',
      onTime,
      offTime
    }
  }

  return null
}

/**
 * Detect intervals in pace data with optional workout structure
 */
function detectIntervals(paces: number[], workoutStructure?: ReturnType<typeof parseWorkoutDescription>): Array<{avgPace: number, duration: number, type: string}> {
  const intervals: Array<{avgPace: number, duration: number, type: string}> = []
  const avgPace = paces.reduce((a, b) => a + b, 0) / paces.length

  let inInterval = false
  let intervalStart = 0
  let intervalPaces: number[] = []

  // Adjust threshold based on workout type
  let threshold = 0.3 // Default: 18+ seconds faster than average
  if (workoutStructure?.type === 'fartlek') {
    threshold = 0.2 // More sensitive for fartlek
  }

  for (let i = 0; i < paces.length; i++) {
    const isHard = paces[i] < avgPace - threshold

    if (isHard && !inInterval) {
      // Start of hard interval
      inInterval = true
      intervalStart = i
      intervalPaces = [paces[i]]
    } else if (isHard && inInterval) {
      // Continue hard interval
      intervalPaces.push(paces[i])
    } else if (!isHard && inInterval) {
      // End of hard interval
      if (intervalPaces.length >= 30) { // At least 30 seconds
        const intervalAvg = intervalPaces.reduce((a, b) => a + b, 0) / intervalPaces.length
        intervals.push({
          avgPace: intervalAvg,
          duration: intervalPaces.length,
          type: 'hard'
        })
      }
      inInterval = false
      intervalPaces = []
    }
  }

  return intervals
}

/**
 * Analyze granular heart rate data
 */
function analyzeGranularHeartRate(heartRates: number[], maxHR?: number): string {
  if (heartRates.length === 0) return ''

  let analysis = `\n### Heart Rate Analysis (second-by-second)\n`

  const avgHR = heartRates.reduce((a, b) => a + b, 0) / heartRates.length
  const minHR = Math.min(...heartRates)
  const maxHRValue = Math.max(...heartRates)

  analysis += `- HR Range: ${Math.round(minHR)} - ${Math.round(maxHRValue)} bpm\n`

  if (maxHR) {
    const avgPercent = Math.round((avgHR / maxHR) * 100)
    const maxPercent = Math.round((maxHRValue / maxHR) * 100)
    analysis += `- Average HR: ${Math.round(avgHR)} bpm (${avgPercent}% of max)\n`
    analysis += `- Peak HR: ${Math.round(maxHRValue)} bpm (${maxPercent}% of max)\n`

    // HR drift analysis (cardiac drift)
    const firstQuarter = heartRates.slice(0, Math.floor(heartRates.length / 4))
    const lastQuarter = heartRates.slice(Math.floor(heartRates.length * 3 / 4))
    const firstAvg = firstQuarter.reduce((a, b) => a + b, 0) / firstQuarter.length
    const lastAvg = lastQuarter.reduce((a, b) => a + b, 0) / lastQuarter.length
    const drift = lastAvg - firstAvg

    if (drift > 5) {
      analysis += `- Cardiac Drift: +${Math.round(drift)} bpm (${Math.round((drift / firstAvg) * 100)}% increase - may indicate dehydration or fatigue)\n`
    } else if (drift < -5) {
      analysis += `- Cardiac Drift: ${Math.round(drift)} bpm (HR decreased - good recovery or pacing adjustment)\n`
    } else {
      analysis += `- Cardiac Drift: Minimal (${Math.round(drift)} bpm - excellent cardiovascular efficiency)\n`
    }
  }

  return analysis
}

/**
 * Analyze granular cadence data
 */
function analyzeGranularCadence(cadences: number[]): string {
  if (cadences.length === 0) return ''

  let analysis = `\n### Cadence Analysis\n`

  // Cadence is stored as steps per second, multiply by 2 for steps per minute
  const spmValues = cadences.map(c => c * 2)
  const avgCadence = spmValues.reduce((a, b) => a + b, 0) / spmValues.length
  const minCadence = Math.min(...spmValues)
  const maxCadence = Math.max(...spmValues)

  analysis += `- Average Cadence: ${Math.round(avgCadence)} spm\n`
  analysis += `- Cadence Range: ${Math.round(minCadence)} - ${Math.round(maxCadence)} spm\n`

  // Optimal cadence is typically 170-180 spm
  if (avgCadence >= 170 && avgCadence <= 180) {
    analysis += `- Cadence Assessment: Optimal range (170-180 spm) - excellent form!\n`
  } else if (avgCadence < 170) {
    analysis += `- Cadence Assessment: Below optimal (${Math.round(170 - avgCadence)} spm lower) - consider increasing turnover\n`
  } else {
    analysis += `- Cadence Assessment: Above typical range - may indicate short stride length\n`
  }

  return analysis
}

/**
 * Format pace from decimal minutes to MM:SS
 */
function formatPace(pace: number): string {
  const minutes = Math.floor(pace)
  const seconds = Math.round((pace - minutes) * 60)
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}


