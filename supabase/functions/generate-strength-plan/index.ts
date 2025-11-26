import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface StrengthOnboardingData {
  strength_goals: string[]
  weight_goal: string
  target_weight?: number
  running_integration: string
  training_days: string[]
  equipment_access: string
  experience_level: string
  additional_notes?: string
  plan_weeks: number
}

interface GeneratedSession {
  week_number: number
  day_of_week: string
  session_type: string
  session_name: string
  focus_areas: string[]
  estimated_duration: number
  warmup_notes: string
  cooldown_notes: string
  exercises: {
    exercise_name: string
    sets: number
    reps: string
    weight_suggestion: string
    rest_seconds: number
    notes?: string
  }[]
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('No authorization header')
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      throw new Error('Unauthorized')
    }

    const { onboardingData } = await req.json() as { onboardingData: StrengthOnboardingData }

    // Fetch user profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    // Fetch user's running plan
    const { data: runningPlan } = await supabase
      .from('training_plans')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single()

    // Fetch upcoming runs if plan exists
    let upcomingRuns: any[] = []
    if (runningPlan) {
      const { data: runs } = await supabase
        .from('runs')
        .select('*')
        .eq('training_plan_id', runningPlan.id)
        .gte('scheduled_date', new Date().toISOString().split('T')[0])
        .order('scheduled_date', { ascending: true })
        .limit(30)
      upcomingRuns = runs || []
    }

    // Build the prompt for OpenAI
    const systemPrompt = buildSystemPrompt()
    const userPrompt = buildUserPrompt(onboardingData, profile, runningPlan, upcomingRuns)

    // Call OpenAI
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        response_format: { type: 'json_object' }
      })
    })

    if (!openaiResponse.ok) {
      const error = await openaiResponse.text()
      throw new Error(`OpenAI error: ${error}`)
    }

    const completion = await openaiResponse.json()
    const generatedPlan = JSON.parse(completion.choices[0].message.content)

    // Create the strength plan
    const startDate = new Date()
    const endDate = new Date()
    endDate.setDate(endDate.getDate() + (onboardingData.plan_weeks * 7))

    const { data: strengthPlan, error: planError } = await supabase
      .from('strength_training_plans')
      .insert({
        user_id: user.id,
        name: generatedPlan.plan_name || `${onboardingData.plan_weeks}-Week Strength Plan`,
        strength_goals: onboardingData.strength_goals,
        weight_goal: onboardingData.weight_goal,
        target_weight: onboardingData.target_weight,
        running_integration: onboardingData.running_integration,
        training_days: onboardingData.training_days,
        equipment_access: onboardingData.equipment_access,
        experience_level: onboardingData.experience_level,
        additional_notes: onboardingData.additional_notes,
        start_date: startDate.toISOString().split('T')[0],
        end_date: endDate.toISOString().split('T')[0],
        weeks: onboardingData.plan_weeks,
        sessions_per_week: onboardingData.training_days.length,
        status: 'active'
      })
      .select()
      .single()

    if (planError) {
      throw new Error(`Failed to create plan: ${planError.message}`)
    }

    // Create sessions from generated plan
    const sessions = generatedPlan.sessions as GeneratedSession[]
    const createdSessions = await createSessions(supabase, user.id, strengthPlan.id, sessions, startDate)

    return new Response(JSON.stringify({
      success: true,
      plan: strengthPlan,
      sessions_created: createdSessions.length,
      ai_summary: generatedPlan.summary
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

function buildSystemPrompt(): string {
  return `You are an expert strength and conditioning coach specializing in programs for runners.
Your job is to create personalized strength training plans that complement running training.

Key principles:
1. For runners, focus on:
   - Lower body strength and power (glutes, hamstrings, quads, calves)
   - Core stability and rotational strength
   - Hip mobility and stability
   - Injury prevention (especially for IT band, knees, ankles)
   - Upper body posture for running efficiency

2. Schedule strength around running:
   - Avoid heavy leg work before quality running sessions
   - Place easier/mobility work on rest days
   - Consider recovery needs between sessions

3. Progressive overload:
   - Start conservatively based on experience level
   - Plan for gradual progression each week
   - Include deload weeks for recovery

4. Equipment considerations:
   - Adapt exercises to available equipment
   - Provide alternatives when needed
   - Bodyweight options are often excellent for runners

You must respond in valid JSON format with this structure:
{
  "plan_name": "string - a descriptive name for the plan",
  "summary": "string - 2-3 sentence summary of the plan approach",
  "sessions": [
    {
      "week_number": number,
      "day_of_week": "string - Monday, Tuesday, etc.",
      "session_type": "string - lower_body, upper_body, full_body, core, mobility, power",
      "session_name": "string - descriptive name like 'Lower Body Strength'",
      "focus_areas": ["string array of muscle groups"],
      "estimated_duration": number (minutes),
      "warmup_notes": "string - warmup instructions",
      "cooldown_notes": "string - cooldown/stretch instructions",
      "exercises": [
        {
          "exercise_name": "string - name of exercise",
          "sets": number,
          "reps": "string - can be '8-10' or '12' or 'AMRAP' or '30 seconds'",
          "weight_suggestion": "string - like 'bodyweight', 'light', 'moderate', 'challenging'",
          "rest_seconds": number,
          "notes": "string - optional form cues or modifications"
        }
      ]
    }
  ]
}`
}

function buildUserPrompt(
  onboarding: StrengthOnboardingData,
  profile: any,
  runningPlan: any,
  upcomingRuns: any[]
): string {
  let prompt = `Create a ${onboarding.plan_weeks}-week strength training plan with the following details:

## User Goals
- Strength Goals: ${onboarding.strength_goals.join(', ')}
- Weight Goal: ${onboarding.weight_goal}${onboarding.target_weight ? ` (target: ${onboarding.target_weight}kg)` : ''}
- Running Integration: ${onboarding.running_integration}
- Training Days: ${onboarding.training_days.join(', ')}
- Equipment Access: ${onboarding.equipment_access}
- Experience Level: ${onboarding.experience_level}
${onboarding.additional_notes ? `- Additional Notes: ${onboarding.additional_notes}` : ''}

## User Profile
- Experience: ${profile?.running_experience || 'unknown'}
- Weight: ${profile?.weight_kg ? `${profile.weight_kg}kg` : 'not specified'}
- Age: ${profile?.age || 'not specified'}
`

  if (runningPlan) {
    prompt += `
## Running Plan Context
The user has an active running plan: "${runningPlan.name}"
- Goal: ${runningPlan.goal_race || 'General training'}
- Duration: ${runningPlan.weeks} weeks
- Status: Active
`
  }

  if (upcomingRuns.length > 0) {
    const runsByDay: { [key: string]: string[] } = {}
    upcomingRuns.forEach(run => {
      const dayOfWeek = new Date(run.scheduled_date).toLocaleDateString('en-US', { weekday: 'long' })
      if (!runsByDay[dayOfWeek]) runsByDay[dayOfWeek] = []
      runsByDay[dayOfWeek].push(`${run.run_type} (${run.planned_distance || '?'}km)`)
    })

    prompt += `
## Typical Running Schedule
${Object.entries(runsByDay).map(([day, runs]) => `- ${day}: ${runs.slice(0, 2).join(', ')}`).join('\n')}
`
  }

  prompt += `
## Requirements
1. Generate ${onboarding.training_days.length} sessions per week for ${onboarding.plan_weeks} weeks
2. Only schedule on: ${onboarding.training_days.join(', ')}
3. Each session should have 4-8 exercises appropriate for the equipment access
4. Include warmup and cooldown notes
5. Progress difficulty appropriately over the weeks
6. If complementing running, avoid heavy leg work before quality running sessions
7. For injury prevention focus, emphasize hip stability, glute activation, and eccentric exercises

Create the complete plan now.`

  return prompt
}

async function createSessions(
  supabase: any,
  userId: string,
  planId: string,
  sessions: GeneratedSession[],
  startDate: Date
): Promise<any[]> {
  const createdSessions = []

  for (const session of sessions) {
    // Calculate actual date based on week number and day
    const sessionDate = new Date(startDate)
    sessionDate.setDate(sessionDate.getDate() + ((session.week_number - 1) * 7))

    // Find the correct day
    const dayIndex = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
      .indexOf(session.day_of_week)
    const currentDayIndex = sessionDate.getDay()
    const daysToAdd = (dayIndex - currentDayIndex + 7) % 7
    sessionDate.setDate(sessionDate.getDate() + daysToAdd)

    // Create the session
    const { data: createdSession, error: sessionError } = await supabase
      .from('strength_sessions')
      .insert({
        user_id: userId,
        strength_plan_id: planId,
        week_number: session.week_number,
        day_of_week: session.day_of_week,
        scheduled_date: sessionDate.toISOString().split('T')[0],
        session_type: session.session_type,
        session_name: session.session_name,
        focus_areas: session.focus_areas,
        estimated_duration: session.estimated_duration,
        warmup_notes: session.warmup_notes,
        cooldown_notes: session.cooldown_notes,
        completed: false
      })
      .select()
      .single()

    if (sessionError) {
      console.error('Error creating session:', sessionError)
      continue
    }

    // Create exercises for this session
    for (let i = 0; i < session.exercises.length; i++) {
      const exercise = session.exercises[i]

      // Try to find matching exercise in library
      const { data: libraryExercise } = await supabase
        .from('exercises')
        .select('id')
        .ilike('name', exercise.exercise_name)
        .single()

      await supabase
        .from('session_exercises')
        .insert({
          session_id: createdSession.id,
          exercise_id: libraryExercise?.id || null,
          custom_exercise_name: libraryExercise ? null : exercise.exercise_name,
          exercise_order: i + 1,
          planned_sets: exercise.sets,
          planned_reps: exercise.reps,
          planned_weight: exercise.weight_suggestion,
          planned_rest_seconds: exercise.rest_seconds,
          notes: exercise.notes
        })
    }

    createdSessions.push(createdSession)
  }

  return createdSessions
}

