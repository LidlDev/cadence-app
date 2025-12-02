// Supabase Edge Function for linking a Strava activity to a run
// Mirrors the web app's /api/strava/link-activity endpoint
// Now also updates Strava activity description with training plan info

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Format training plan info for Strava description
function formatTrainingPlanDescription(run: any, trainingPlan: any): string {
  const lines: string[] = []

  // Add Cadence header
  lines.push('🏃 CADENCE TRAINING')
  lines.push('━━━━━━━━━━━━━━━━━━━')

  // Training plan name
  if (trainingPlan?.name) {
    lines.push(`📋 ${trainingPlan.name}`)
  }

  // Week number
  if (run.week_number) {
    lines.push(`📅 Week ${run.week_number}${trainingPlan?.weeks ? ` of ${trainingPlan.weeks}` : ''}`)
  }

  // Run type and distance
  const distanceStr = run.planned_distance ? `${run.planned_distance}km` : ''
  if (run.run_type) {
    lines.push(`🎯 ${run.run_type}${distanceStr ? ` - ${distanceStr}` : ''}`)
  }

  // Target pace if available
  if (run.target_pace) {
    lines.push(`⏱️ Target: ${run.target_pace}/km`)
  }

  // Notes from the training plan (workout instructions)
  if (run.notes) {
    lines.push('')
    lines.push('📝 Workout:')
    lines.push(run.notes)
  }

  // User comments (post-run reflection)
  if (run.comments) {
    lines.push('')
    lines.push('💭 Notes:')
    lines.push(run.comments)
  }

  lines.push('')
  lines.push('━━━━━━━━━━━━━━━━━━━')
  lines.push('Tracked with Cadence')

  return lines.join('\n')
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), 
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const { runId, stravaActivityId } = await req.json()
    if (!runId || !stravaActivityId) {
      return new Response(JSON.stringify({ error: 'Missing runId or stravaActivityId' }), 
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const jwt = authHeader.replace('Bearer ', '')

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    })

    const { data: { user }, error: userError } = await supabase.auth.getUser(jwt)
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), 
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Get Strava tokens
    const { data: tokenData, error: tokenError } = await supabase
      .from('strava_tokens').select('access_token, refresh_token, expires_at').eq('user_id', user.id).single()

    if (tokenError || !tokenData) {
      return new Response(JSON.stringify({ error: 'Strava not connected' }), 
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Check if token needs refresh
    let accessToken = tokenData.access_token
    if (new Date(tokenData.expires_at) < new Date()) {
      const refreshResponse = await fetch('https://www.strava.com/oauth/token', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: Deno.env.get('STRAVA_CLIENT_ID'),
          client_secret: Deno.env.get('STRAVA_CLIENT_SECRET'),
          grant_type: 'refresh_token', refresh_token: tokenData.refresh_token,
        }),
      })
      if (!refreshResponse.ok) {
        return new Response(JSON.stringify({ error: 'Failed to refresh Strava token' }), 
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      const refreshData = await refreshResponse.json()
      accessToken = refreshData.access_token
      await supabase.from('strava_tokens').update({
        access_token: refreshData.access_token, refresh_token: refreshData.refresh_token,
        expires_at: new Date(refreshData.expires_at * 1000).toISOString(),
      }).eq('user_id', user.id)
    }

    // Fetch run data with training plan info for description update
    const { data: runData } = await supabase
      .from('runs')
      .select(`
        id, week_number, run_type, planned_distance, target_pace, notes, comments,
        training_plan_id,
        training_plans:training_plan_id (id, name, weeks, goal_race)
      `)
      .eq('id', runId)
      .eq('user_id', user.id)
      .single()

    // Fetch detailed activity data
    const activityResponse = await fetch(`https://www.strava.com/api/v3/activities/${stravaActivityId}`,
      { headers: { Authorization: `Bearer ${accessToken}` } })

    if (!activityResponse.ok) {
      return new Response(JSON.stringify({ error: 'Failed to fetch activity details' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const activity = await activityResponse.json()

    // Calculate pace and format time
    const distanceKm = activity.distance / 1000
    const timeSeconds = activity.moving_time
    const paceSecondsPerKm = timeSeconds / distanceKm
    const paceMinutes = Math.floor(paceSecondsPerKm / 60)
    const paceSeconds = Math.floor(paceSecondsPerKm % 60)
    const pace = `${paceMinutes}:${paceSeconds.toString().padStart(2, '0')}`

    const hours = Math.floor(timeSeconds / 3600)
    const minutes = Math.floor((timeSeconds % 3600) / 60)
    const secs = timeSeconds % 60
    const duration = hours > 0 ? `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}` : `${minutes}:${secs.toString().padStart(2, '0')}`

    // Update the run with Strava data
    const { error: updateError } = await supabase.from('runs').update({
      strava_activity_id: stravaActivityId,
      actual_distance: parseFloat(distanceKm.toFixed(2)),
      actual_time: duration, actual_pace: pace, completed: true,
      average_hr: activity.average_heartrate ? Math.round(activity.average_heartrate) : null,
      max_hr: activity.max_heartrate ? Math.round(activity.max_heartrate) : null,
      elevation_gain: activity.total_elevation_gain ? parseFloat(activity.total_elevation_gain.toFixed(1)) : null,
      average_cadence: activity.average_cadence ? parseFloat(activity.average_cadence.toFixed(1)) : null,
      calories: activity.calories ? Math.round(activity.calories) : null,
      suffer_score: activity.suffer_score ? Math.round(activity.suffer_score) : null,
      moving_time: activity.moving_time ? Math.round(activity.moving_time) : null,
      elapsed_time: activity.elapsed_time ? Math.round(activity.elapsed_time) : null,
      strava_description: activity.description || null,
      updated_at: new Date().toISOString(),
    }).eq('id', runId).eq('user_id', user.id)

    if (updateError) {
      console.error('Error updating run:', updateError)
      return new Response(JSON.stringify({ error: 'Failed to update run' }), 
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Fetch and store activity streams
    const streamTypes = ['time', 'distance', 'latlng', 'altitude', 'velocity_smooth', 'heartrate', 'cadence', 'watts', 'temp', 'grade_smooth']
    const streamsResponse = await fetch(
      `https://www.strava.com/api/v3/activities/${stravaActivityId}/streams?keys=${streamTypes.join(',')}&key_by_type=true`,
      { headers: { Authorization: `Bearer ${accessToken}` } })

    if (streamsResponse.ok) {
      const streamsData = await streamsResponse.json()
      const streamInserts = Object.entries(streamsData).map(([type, stream]: [string, any]) => ({
        user_id: user.id, run_id: runId, stream_type: type, data: stream.data,
        original_size: stream.original_size, resolution: stream.resolution, series_type: stream.series_type,
      }))
      if (streamInserts.length > 0) {
        await supabase.from('activity_streams').delete().eq('run_id', runId)
        await supabase.from('activity_streams').insert(streamInserts)
      }
    }

    // Update Strava activity description with training plan info
    // Prepend training plan info to existing description (but only if not already added)
    console.log('[strava-link-activity] Run data:', {
      hasRunData: !!runData,
      trainingPlanId: runData?.training_plan_id,
      runType: runData?.run_type,
      weekNumber: runData?.week_number
    })

    if (runData && runData.training_plan_id) {
      const existingDescription = activity.description || ''
      console.log('[strava-link-activity] Existing Strava description:', existingDescription.substring(0, 100))

      // Check if we've already added Cadence info to avoid duplicates
      if (!existingDescription.includes('🏃 CADENCE TRAINING')) {
        const trainingPlan = runData.training_plans
        const cadenceDescription = formatTrainingPlanDescription(runData, trainingPlan)
        console.log('[strava-link-activity] Generated Cadence description:', cadenceDescription.substring(0, 100))

        // Combine with existing Strava description (if any)
        const newDescription = existingDescription
          ? `${cadenceDescription}\n\n─────────────────\n\n${existingDescription}`
          : cadenceDescription

        // Update the Strava activity description
        try {
          const updateResponse = await fetch(`https://www.strava.com/api/v3/activities/${stravaActivityId}`, {
            method: 'PUT',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ description: newDescription })
          })

          if (!updateResponse.ok) {
            console.error('[strava-link-activity] Failed to update Strava description:', await updateResponse.text())
          } else {
            console.log('[strava-link-activity] Successfully updated Strava activity description')
          }
        } catch (descError) {
          // Don't fail the whole operation if description update fails
          console.error('[strava-link-activity] Error updating Strava description:', descError)
        }
      } else {
        console.log('[strava-link-activity] Strava description already contains Cadence info, skipping update')
      }
    } else {
      console.log('[strava-link-activity] Skipping description update - no training plan linked to this run')
    }

    return new Response(JSON.stringify({ success: true, message: 'Successfully linked Strava activity' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (error: any) {
    console.error('Error:', error)
    return new Response(JSON.stringify({ error: error.message || 'Internal error' }), 
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})

