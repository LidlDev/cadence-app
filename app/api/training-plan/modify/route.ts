import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

/**
 * Training Plan Modification API
 * Allows AI to make structured changes to training plans
 */

export async function POST(request: NextRequest) {
  try {
    const { action, params } = await request.json()

    // Check if request has Authorization header (from Edge Function)
    const authHeader = request.headers.get('Authorization')
    let supabase
    let user

    if (authHeader && authHeader.startsWith('Bearer ')) {
      // JWT-based auth from Edge Function
      const jwt = authHeader.replace('Bearer ', '')
      supabase = createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          global: {
            headers: { Authorization: authHeader },
          },
        }
      )
      const { data: { user: jwtUser }, error: userError } = await supabase.auth.getUser(jwt)
      if (userError || !jwtUser) {
        console.error('JWT auth failed:', userError)
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      user = jwtUser
    } else {
      // Cookie-based auth from browser
      supabase = await createClient()
      const { data: { user: cookieUser } } = await supabase.auth.getUser()
      if (!cookieUser) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      user = cookieUser
    }

    // Get active training plan
    const { data: plan } = await supabase
      .from('training_plans')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single()

    if (!plan) {
      return NextResponse.json({ error: 'No active training plan found' }, { status: 404 })
    }

    let result

    switch (action) {
      case 'add_runs':
        result = await addRuns(supabase, user.id, plan.id, params)
        break
      case 'move_run_type':
        result = await moveRunType(supabase, user.id, plan.id, params)
        break
      case 'change_distances':
        result = await changeDistances(supabase, user.id, plan.id, params)
        break
      case 'change_run_type':
        result = await changeRunType(supabase, user.id, plan.id, params)
        break
      case 'add_weeks':
        result = await addWeeks(supabase, user.id, plan.id, params)
        break
      case 'delete_runs':
        result = await deleteRuns(supabase, user.id, plan.id, params)
        break
      case 'modify_single_run':
        result = await modifySingleRun(supabase, user.id, params)
        break
      case 'analyze_and_optimize':
        result = await analyzeAndOptimizePlan(supabase, user.id, plan.id, params)
        break
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    return NextResponse.json({ success: true, result })
  } catch (error: any) {
    console.error('Error modifying training plan:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

/**
 * Add new runs to the training plan
 */
async function addRuns(supabase: any, userId: string, planId: string, params: any) {
  const { runs } = params // Array of run objects

  const runsToInsert = runs.map((run: any) => ({
    user_id: userId,
    training_plan_id: planId,
    week_number: run.week_number,
    day_of_week: run.day_of_week,
    run_type: run.run_type,
    session_type: run.session_type || null,
    planned_distance: run.planned_distance,
    target_pace: run.target_pace || null,
    scheduled_date: run.scheduled_date,
    completed: false,
  }))

  const { data, error } = await supabase.from('runs').insert(runsToInsert).select()

  if (error) throw error
  return { added: data.length, runs: data }
}

/**
 * Move all runs of a specific type to a different day of week
 */
async function moveRunType(supabase: any, userId: string, planId: string, params: any) {
  const { run_type, new_day_of_week } = params

  // Get all runs of this type
  const { data: runs } = await supabase
    .from('runs')
    .select('*')
    .eq('user_id', userId)
    .eq('training_plan_id', planId)
    .eq('run_type', run_type)
    .eq('completed', false)

  if (!runs || runs.length === 0) {
    return { updated: 0, message: `No ${run_type} runs found` }
  }

  // Update each run with new day and recalculated date
  const updates = []
  for (const run of runs) {
    const newDate = calculateNewDate(run.scheduled_date, run.day_of_week, new_day_of_week)
    updates.push(
      supabase
        .from('runs')
        .update({
          day_of_week: new_day_of_week,
          scheduled_date: newDate,
        })
        .eq('id', run.id)
    )
  }

  await Promise.all(updates)

  return { updated: runs.length, run_type, new_day: new_day_of_week }
}

/**
 * Change distances for runs matching criteria
 */
async function changeDistances(supabase: any, userId: string, planId: string, params: any) {
  const { run_type, new_distance, week_range } = params

  let query = supabase
    .from('runs')
    .update({ planned_distance: new_distance })
    .eq('user_id', userId)
    .eq('training_plan_id', planId)
    .eq('completed', false)

  if (run_type) {
    query = query.eq('run_type', run_type)
  }

  if (week_range) {
    query = query.gte('week_number', week_range.start).lte('week_number', week_range.end)
  }

  const { data, error } = await query.select()

  if (error) throw error
  return { updated: data?.length || 0 }
}

/**
 * Change run type for runs matching criteria
 */
async function changeRunType(supabase: any, userId: string, planId: string, params: any) {
  const { old_run_type, new_run_type, week_range, day_of_week } = params

  let query = supabase
    .from('runs')
    .update({ run_type: new_run_type })
    .eq('user_id', userId)
    .eq('training_plan_id', planId)
    .eq('completed', false)

  if (old_run_type) {
    query = query.eq('run_type', old_run_type)
  }

  if (week_range) {
    query = query.gte('week_number', week_range.start).lte('week_number', week_range.end)
  }

  if (day_of_week) {
    query = query.eq('day_of_week', day_of_week)
  }

  const { data, error } = await query.select()

  if (error) throw error
  return { updated: data?.length || 0, old_type: old_run_type, new_type: new_run_type }
}

/**
 * Add weeks to the training plan
 */
async function addWeeks(supabase: any, userId: string, planId: string, params: any) {
  const { num_weeks, phase_type, template } = params

  // Get the current plan
  const { data: plan } = await supabase
    .from('training_plans')
    .select('*')
    .eq('id', planId)
    .single()

  // Get the last week number
  const { data: lastRun } = await supabase
    .from('runs')
    .select('week_number')
    .eq('training_plan_id', planId)
    .order('week_number', { ascending: false })
    .limit(1)
    .single()

  const startWeek = (lastRun?.week_number || 0) + 1

  // Generate runs based on template
  const newRuns = []
  for (let week = 0; week < num_weeks; week++) {
    const weekNumber = startWeek + week

    // Default template: 4 runs per week
    const weekTemplate = template || [
      { day: 'Monday', type: 'Easy Run', distance: 8 },
      { day: 'Wednesday', type: 'Tempo Run', distance: 10 },
      { day: 'Friday', type: 'Easy Run', distance: 8 },
      { day: 'Sunday', type: 'Long Run', distance: 16 },
    ]

    for (const run of weekTemplate) {
      const scheduledDate = calculateDateForWeekAndDay(plan.start_date, weekNumber, run.day)
      newRuns.push({
        user_id: userId,
        training_plan_id: planId,
        week_number: weekNumber,
        day_of_week: run.day,
        run_type: run.type,
        planned_distance: run.distance,
        scheduled_date: scheduledDate,
        completed: false,
      })
    }
  }

  const { data, error } = await supabase.from('runs').insert(newRuns).select()

  if (error) throw error

  // Update plan end date and weeks
  const newEndDate = new Date(plan.end_date)
  newEndDate.setDate(newEndDate.getDate() + num_weeks * 7)

  await supabase
    .from('training_plans')
    .update({
      weeks: plan.weeks + num_weeks,
      end_date: newEndDate.toISOString().split('T')[0],
    })
    .eq('id', planId)

  return { added_weeks: num_weeks, added_runs: data.length }
}

/**
 * Delete runs matching criteria
 */
async function deleteRuns(supabase: any, userId: string, planId: string, params: any) {
  const { run_ids, run_type, week_range } = params

  if (run_ids) {
    const { error } = await supabase
      .from('runs')
      .delete()
      .eq('user_id', userId)
      .in('id', run_ids)

    if (error) throw error
    return { deleted: run_ids.length }
  }

  let query = supabase
    .from('runs')
    .delete()
    .eq('user_id', userId)
    .eq('training_plan_id', planId)
    .eq('completed', false)

  if (run_type) {
    query = query.eq('run_type', run_type)
  }

  if (week_range) {
    query = query.gte('week_number', week_range.start).lte('week_number', week_range.end)
  }

  const { data, error } = await query.select()

  if (error) throw error
  return { deleted: data?.length || 0 }
}

/**
 * Helper: Calculate new date when moving a run to a different day
 */
function calculateNewDate(currentDate: string, currentDay: string, newDay: string): string {
  const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
  const currentDayIndex = daysOfWeek.indexOf(currentDay)
  const newDayIndex = daysOfWeek.indexOf(newDay)

  const date = new Date(currentDate)
  const dayDiff = newDayIndex - currentDayIndex
  date.setDate(date.getDate() + dayDiff)

  return date.toISOString().split('T')[0]
}

/**
 * Helper: Calculate date for a specific week and day
 */
function calculateDateForWeekAndDay(planStartDate: string, weekNumber: number, dayOfWeek: string): string {
  const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
  const dayIndex = daysOfWeek.indexOf(dayOfWeek)

  const startDate = new Date(planStartDate)
  const weeksOffset = (weekNumber - 1) * 7
  const daysOffset = weeksOffset + dayIndex

  const targetDate = new Date(startDate)
  targetDate.setDate(targetDate.getDate() + daysOffset)

  return targetDate.toISOString().split('T')[0]
}

/**
 * Modify a single run by ID with targeted changes
 */
async function modifySingleRun(supabase: any, userId: string, params: any) {
  const { run_id, changes } = params

  if (!run_id) {
    throw new Error('run_id is required')
  }

  // Verify the run belongs to the user
  const { data: existingRun, error: fetchError } = await supabase
    .from('runs')
    .select('*')
    .eq('id', run_id)
    .eq('user_id', userId)
    .single()

  if (fetchError || !existingRun) {
    throw new Error(`Run not found or access denied: ${run_id}`)
  }

  // Build the update object with only provided changes
  const updateData: Record<string, any> = {}

  if (changes.run_type !== undefined) updateData.run_type = changes.run_type
  if (changes.session_type !== undefined) updateData.session_type = changes.session_type
  if (changes.planned_distance !== undefined) updateData.planned_distance = changes.planned_distance
  if (changes.target_pace !== undefined) updateData.target_pace = changes.target_pace
  if (changes.notes !== undefined) updateData.notes = changes.notes

  // Handle day/date changes
  if (changes.day_of_week !== undefined) {
    updateData.day_of_week = changes.day_of_week
    // Recalculate the scheduled date if day changes but date not explicitly provided
    if (!changes.scheduled_date) {
      updateData.scheduled_date = calculateNewDate(
        existingRun.scheduled_date,
        existingRun.day_of_week,
        changes.day_of_week
      )
    }
  }

  if (changes.scheduled_date !== undefined) {
    updateData.scheduled_date = changes.scheduled_date
  }

  if (Object.keys(updateData).length === 0) {
    return { updated: false, message: 'No changes provided' }
  }

  const { data, error } = await supabase
    .from('runs')
    .update(updateData)
    .eq('id', run_id)
    .eq('user_id', userId)
    .select()
    .single()

  if (error) throw error

  return {
    updated: true,
    run: data,
    changes_applied: Object.keys(updateData),
    message: `Successfully updated run: ${Object.keys(updateData).join(', ')}`
  }
}

/**
 * Analyze and optimize the training plan with multiple modifications
 */
async function analyzeAndOptimizePlan(supabase: any, userId: string, planId: string, params: any) {
  const { modifications, optimization_goals, target_race_distance, target_race_date, weekly_mileage_target } = params

  if (!modifications || !Array.isArray(modifications) || modifications.length === 0) {
    throw new Error('modifications array is required')
  }

  const results = {
    successful: [] as any[],
    failed: [] as any[],
    optimization_goals: optimization_goals || [],
    target_race_distance,
    target_race_date,
    weekly_mileage_target,
  }

  // Process each modification
  for (const mod of modifications) {
    try {
      const { run_id, changes } = mod

      if (!run_id || !changes) {
        results.failed.push({ run_id, error: 'Missing run_id or changes' })
        continue
      }

      // Verify the run belongs to the user and plan
      const { data: existingRun, error: fetchError } = await supabase
        .from('runs')
        .select('*')
        .eq('id', run_id)
        .eq('user_id', userId)
        .eq('training_plan_id', planId)
        .single()

      if (fetchError || !existingRun) {
        results.failed.push({ run_id, error: 'Run not found or access denied' })
        continue
      }

      // Build update object
      const updateData: Record<string, any> = {}

      if (changes.run_type !== undefined) updateData.run_type = changes.run_type
      if (changes.session_type !== undefined) updateData.session_type = changes.session_type
      if (changes.planned_distance !== undefined) updateData.planned_distance = changes.planned_distance
      if (changes.target_pace !== undefined) updateData.target_pace = changes.target_pace
      if (changes.notes !== undefined) updateData.notes = changes.notes

      if (changes.day_of_week !== undefined) {
        updateData.day_of_week = changes.day_of_week
        if (!changes.scheduled_date) {
          updateData.scheduled_date = calculateNewDate(
            existingRun.scheduled_date,
            existingRun.day_of_week,
            changes.day_of_week
          )
        }
      }

      if (changes.scheduled_date !== undefined) {
        updateData.scheduled_date = changes.scheduled_date
      }

      if (Object.keys(updateData).length === 0) {
        results.failed.push({ run_id, error: 'No valid changes provided' })
        continue
      }

      const { data, error } = await supabase
        .from('runs')
        .update(updateData)
        .eq('id', run_id)
        .select()
        .single()

      if (error) {
        results.failed.push({ run_id, error: error.message })
      } else {
        results.successful.push({
          run_id,
          changes_applied: Object.keys(updateData),
          updated_run: data,
        })
      }
    } catch (error: any) {
      results.failed.push({ run_id: mod.run_id, error: error.message })
    }
  }

  return {
    total_modifications: modifications.length,
    successful_count: results.successful.length,
    failed_count: results.failed.length,
    successful: results.successful,
    failed: results.failed,
    optimization_summary: {
      goals: results.optimization_goals,
      target_race: target_race_distance ? `${target_race_distance} on ${target_race_date || 'TBD'}` : null,
      weekly_mileage_target,
    },
    message: `Optimized ${results.successful.length} of ${modifications.length} runs successfully`,
  }
}


