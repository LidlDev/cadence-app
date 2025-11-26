import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('No authorization header')

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const { plan, recentSessions, weeksToAdd } = await req.json()
    
    // Find the highest week number
    const maxWeek = Math.max(...recentSessions.map((s: any) => s.week_number))
    const startWeek = maxWeek + 1
    const endWeek = maxWeek + weeksToAdd

    // Build prompt from recent sessions
    const sessionPatterns = recentSessions.map((s: any) => ({
      day: s.day_of_week,
      type: s.session_type,
      name: s.session_name,
      duration: s.estimated_duration,
      focus: s.focus_areas,
      exerciseCount: s.session_exercises?.length || 0,
      exercises: s.session_exercises?.map((e: any) => ({
        name: e.exercise?.name || e.custom_exercise_name,
        sets: e.planned_sets,
        reps: e.planned_reps
      }))
    }))

    const systemPrompt = `You are a strength coach continuing an existing training plan.
Generate ${weeksToAdd} more weeks (weeks ${startWeek}-${endWeek}) that build on the previous progression.

Rules:
1. Keep the same training days: ${plan.training_days?.join(', ')}
2. Progress exercises appropriately (slight increases in sets/reps/difficulty)
3. Include a deload week every 4th week if applicable
4. Match the session structure from recent weeks
5. Equipment available: ${plan.equipment_access}
6. Experience level: ${plan.experience_level}

Respond in JSON: { "sessions": [...] } with each session having:
week_number, day_of_week, session_type, session_name, focus_areas[], estimated_duration,
warmup_notes, cooldown_notes, exercises[{exercise_name, sets, reps, weight_suggestion, rest_seconds, notes}]`

    const userPrompt = `Recent session patterns:\n${JSON.stringify(sessionPatterns, null, 2)}\n\nGenerate weeks ${startWeek} to ${endWeek}.`

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

    if (!openaiResponse.ok) throw new Error(`OpenAI error: ${await openaiResponse.text()}`)

    const completion = await openaiResponse.json()
    const generated = JSON.parse(completion.choices[0].message.content)

    // Pre-fetch exercise library
    const { data: exerciseLibrary } = await supabase.from('exercises').select('id, name')
    const exerciseLookup = new Map(exerciseLibrary?.map((e: any) => [e.name.toLowerCase(), e.id]) || [])

    // Calculate dates for new sessions
    const lastSession = recentSessions[0]
    const lastDate = new Date(lastSession.scheduled_date)
    
    // Prepare batch inserts
    const sessionInserts = generated.sessions.map((s: any) => {
      const weekOffset = (s.week_number - maxWeek) * 7
      const dayIndex = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'].indexOf(s.day_of_week)
      const sessionDate = new Date(lastDate)
      sessionDate.setDate(lastDate.getDate() + weekOffset)
      const currentDay = sessionDate.getDay()
      sessionDate.setDate(sessionDate.getDate() + ((dayIndex - currentDay + 7) % 7))

      return {
        user_id: user.id,
        strength_plan_id: plan.id,
        week_number: s.week_number,
        day_of_week: s.day_of_week,
        scheduled_date: sessionDate.toISOString().split('T')[0],
        session_type: s.session_type,
        session_name: s.session_name,
        focus_areas: s.focus_areas || [],
        estimated_duration: s.estimated_duration || 45,
        warmup_notes: s.warmup_notes,
        cooldown_notes: s.cooldown_notes,
        completed: false
      }
    })

    const { data: createdSessions, error: sessErr } = await supabase
      .from('strength_sessions').insert(sessionInserts).select()
    if (sessErr) throw sessErr

    // Batch insert exercises
    const exerciseInserts: any[] = []
    generated.sessions.forEach((s: any, idx: number) => {
      const session = createdSessions[idx]
      s.exercises?.forEach((ex: any, exIdx: number) => {
        exerciseInserts.push({
          session_id: session.id,
          exercise_id: exerciseLookup.get(ex.exercise_name?.toLowerCase()) || null,
          custom_exercise_name: exerciseLookup.has(ex.exercise_name?.toLowerCase()) ? null : ex.exercise_name,
          exercise_order: exIdx + 1,
          planned_sets: ex.sets,
          planned_reps: ex.reps,
          planned_weight: ex.weight_suggestion,
          planned_rest_seconds: ex.rest_seconds || 60,
          notes: ex.notes
        })
      })
    })

    if (exerciseInserts.length > 0) {
      await supabase.from('session_exercises').insert(exerciseInserts)
    }

    // Update plan end date
    const newEndDate = new Date(lastDate)
    newEndDate.setDate(newEndDate.getDate() + (weeksToAdd * 7))
    await supabase.from('strength_training_plans')
      .update({ end_date: newEndDate.toISOString().split('T')[0], weeks: maxWeek + weeksToAdd })
      .eq('id', plan.id)

    return new Response(JSON.stringify({
      success: true,
      sessions_created: createdSessions.length,
      weeks_added: weeksToAdd,
      new_week_range: `${startWeek}-${endWeek}`
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (error) {
    console.error('Error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

