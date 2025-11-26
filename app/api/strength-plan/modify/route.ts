import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { action, params } = await request.json()

    // Get active strength plan
    const { data: strengthPlan } = await supabase
      .from('strength_training_plans')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single()

    if (!strengthPlan && action !== 'analyze_plan') {
      return NextResponse.json({ error: 'No active strength plan found' }, { status: 404 })
    }

    switch (action) {
      case 'modify_session': {
        const { session_id, changes } = params
        const { data, error } = await supabase
          .from('strength_sessions')
          .update({
            ...changes,
            updated_at: new Date().toISOString()
          })
          .eq('id', session_id)
          .eq('user_id', user.id)
          .select()
          .single()

        if (error) throw error
        return NextResponse.json({ success: true, session: data })
      }

      case 'add_sessions': {
        const { sessions } = params
        const sessionsToInsert = sessions.map((s: any) => ({
          user_id: user.id,
          strength_plan_id: strengthPlan!.id,
          week_number: s.week_number,
          session_type: s.session_type,
          session_name: s.session_name || null,
          scheduled_date: s.scheduled_date,
          estimated_duration: s.estimated_duration || 45,
          focus_areas: s.focus_areas || [],
          completed: false,
        }))

        const { data, error } = await supabase
          .from('strength_sessions')
          .insert(sessionsToInsert)
          .select()

        if (error) throw error
        return NextResponse.json({ success: true, sessions: data, count: data.length })
      }

      case 'swap_day': {
        const { session_id, new_date } = params
        const { data, error } = await supabase
          .from('strength_sessions')
          .update({
            scheduled_date: new_date,
            updated_at: new Date().toISOString()
          })
          .eq('id', session_id)
          .eq('user_id', user.id)
          .select()
          .single()

        if (error) throw error
        return NextResponse.json({ success: true, session: data })
      }

      case 'mark_complete': {
        const { session_id, actual_duration, rpe, notes } = params
        const { data, error } = await supabase
          .from('strength_sessions')
          .update({
            completed: true,
            completed_at: new Date().toISOString(),
            actual_duration: actual_duration || null,
            rpe: rpe || null,
            notes: notes || null,
            updated_at: new Date().toISOString()
          })
          .eq('id', session_id)
          .eq('user_id', user.id)
          .select()
          .single()

        if (error) throw error
        return NextResponse.json({ success: true, session: data })
      }

      case 'analyze_plan': {
        const { analysis_type } = params

        // Fetch sessions for analysis
        const { data: sessions } = await supabase
          .from('strength_sessions')
          .select('*')
          .eq('strength_plan_id', strengthPlan?.id)
          .order('scheduled_date', { ascending: true })

        if (!sessions || sessions.length === 0) {
          return NextResponse.json({
            analysis_type,
            result: 'No strength sessions found to analyze.',
            recommendations: ['Create a strength training plan first.']
          })
        }

        // Perform analysis based on type
        const analysis = analyzeStrengthPlan(sessions, analysis_type)
        return NextResponse.json({ success: true, ...analysis })
      }

      case 'add_exercise': {
        const { session_id, exercise_name, sets = 3, reps = '10', weight_suggestion = 'moderate', rest_seconds = 60, notes } = params

        // Find exercise in library
        const { data: libraryExercise } = await supabase
          .from('exercises')
          .select('id')
          .ilike('name', exercise_name)
          .single()

        // Get current max order
        const { data: existingExercises } = await supabase
          .from('session_exercises')
          .select('exercise_order')
          .eq('session_id', session_id)
          .order('exercise_order', { ascending: false })
          .limit(1)

        const nextOrder = (existingExercises?.[0]?.exercise_order || 0) + 1

        const { data, error } = await supabase
          .from('session_exercises')
          .insert({
            session_id,
            exercise_id: libraryExercise?.id || null,
            custom_exercise_name: libraryExercise ? null : exercise_name,
            exercise_order: nextOrder,
            planned_sets: sets,
            planned_reps: reps,
            planned_weight: weight_suggestion,
            planned_rest_seconds: rest_seconds,
            notes
          })
          .select()
          .single()

        if (error) throw error
        return NextResponse.json({ success: true, exercise: data, message: `Added ${exercise_name} to session` })
      }

      case 'remove_exercise': {
        const { session_id, exercise_name } = params

        // Find the exercise to remove
        const { data: exercises } = await supabase
          .from('session_exercises')
          .select('*, exercise:exercises(name)')
          .eq('session_id', session_id)

        const exerciseToRemove = exercises?.find(e =>
          e.exercise?.name?.toLowerCase() === exercise_name.toLowerCase() ||
          e.custom_exercise_name?.toLowerCase() === exercise_name.toLowerCase()
        )

        if (!exerciseToRemove) {
          return NextResponse.json({ error: `Exercise "${exercise_name}" not found in session` }, { status: 404 })
        }

        await supabase.from('session_exercises').delete().eq('id', exerciseToRemove.id)
        return NextResponse.json({ success: true, message: `Removed ${exercise_name} from session` })
      }

      case 'modify_exercise': {
        const { session_id, exercise_name, changes } = params

        // Find the exercise to modify
        const { data: exercises } = await supabase
          .from('session_exercises')
          .select('*, exercise:exercises(name)')
          .eq('session_id', session_id)

        const exerciseToModify = exercises?.find(e =>
          e.exercise?.name?.toLowerCase() === exercise_name.toLowerCase() ||
          e.custom_exercise_name?.toLowerCase() === exercise_name.toLowerCase()
        )

        if (!exerciseToModify) {
          return NextResponse.json({ error: `Exercise "${exercise_name}" not found in session` }, { status: 404 })
        }

        const updateData: any = {}
        if (changes.sets) updateData.planned_sets = changes.sets
        if (changes.reps) updateData.planned_reps = changes.reps
        if (changes.weight_suggestion) updateData.planned_weight = changes.weight_suggestion
        if (changes.rest_seconds) updateData.planned_rest_seconds = changes.rest_seconds
        if (changes.notes) updateData.notes = changes.notes

        const { data, error } = await supabase
          .from('session_exercises')
          .update(updateData)
          .eq('id', exerciseToModify.id)
          .select()
          .single()

        if (error) throw error
        return NextResponse.json({ success: true, exercise: data, message: `Updated ${exercise_name}` })
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
    }
  } catch (error) {
    console.error('Strength plan modification error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

function analyzeStrengthPlan(sessions: any[], analysisType: string) {
  const completed = sessions.filter(s => s.completed)
  const upcoming = sessions.filter(s => !s.completed)
  
  // Count session types
  const typeCounts: Record<string, number> = {}
  sessions.forEach(s => {
    typeCounts[s.session_type] = (typeCounts[s.session_type] || 0) + 1
  })

  switch (analysisType) {
    case 'balance':
      return {
        analysis_type: 'balance',
        session_type_distribution: typeCounts,
        total_sessions: sessions.length,
        recommendations: generateBalanceRecommendations(typeCounts)
      }
    case 'progress':
      return {
        analysis_type: 'progress',
        completed_sessions: completed.length,
        upcoming_sessions: upcoming.length,
        completion_rate: Math.round((completed.length / sessions.length) * 100),
        average_rpe: calculateAverageRPE(completed)
      }
    default:
      return { analysis_type: analysisType, sessions_count: sessions.length }
  }
}

function generateBalanceRecommendations(typeCounts: Record<string, number>): string[] {
  const recommendations: string[] = []
  const total = Object.values(typeCounts).reduce((a, b) => a + b, 0)

  if (!typeCounts['lower_body'] || typeCounts['lower_body'] < total * 0.25) {
    recommendations.push('Consider adding more lower body sessions for running performance')
  }
  if (!typeCounts['core'] || typeCounts['core'] < total * 0.15) {
    recommendations.push('Core work is essential for running stability - add more core sessions')
  }
  if (!typeCounts['mobility'] || typeCounts['mobility'] < total * 0.1) {
    recommendations.push('Mobility work helps prevent injuries - consider adding mobility sessions')
  }

  if (recommendations.length === 0) {
    recommendations.push('Your strength plan has good balance across session types!')
  }

  return recommendations
}

function calculateAverageRPE(sessions: any[]): number | null {
  const sessionsWithRPE = sessions.filter(s => s.rpe != null)
  if (sessionsWithRPE.length === 0) return null
  return Math.round(sessionsWithRPE.reduce((sum, s) => sum + s.rpe, 0) / sessionsWithRPE.length * 10) / 10
}

