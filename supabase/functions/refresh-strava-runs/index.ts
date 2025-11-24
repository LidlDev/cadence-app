import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get the authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create Supabase client with the user's token
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: {
        headers: { Authorization: authHeader },
      },
    })

    // Verify the user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get user's Strava tokens
    const { data: tokenData, error: tokenError } = await supabase
      .from('strava_tokens')
      .select('access_token, refresh_token, expires_at')
      .eq('user_id', user.id)
      .single()

    if (tokenError || !tokenData) {
      return new Response(
        JSON.stringify({ error: 'Strava not connected' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if token needs refresh
    const now = new Date()
    const expiresAt = new Date(tokenData.expires_at)
    let accessToken = tokenData.access_token

    if (expiresAt < now) {
      // Refresh the token
      const refreshResponse = await fetch('https://www.strava.com/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: Deno.env.get('STRAVA_CLIENT_ID'),
          client_secret: Deno.env.get('STRAVA_CLIENT_SECRET'),
          grant_type: 'refresh_token',
          refresh_token: tokenData.refresh_token,
        }),
      })

      if (!refreshResponse.ok) {
        return new Response(
          JSON.stringify({ error: 'Failed to refresh Strava token' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const refreshData = await refreshResponse.json()
      accessToken = refreshData.access_token

      // Update tokens in database
      const newExpiresAt = new Date(refreshData.expires_at * 1000).toISOString()
      await supabase
        .from('strava_tokens')
        .update({
          access_token: refreshData.access_token,
          refresh_token: refreshData.refresh_token,
          expires_at: newExpiresAt,
        })
        .eq('user_id', user.id)
    }

    // Get all runs with Strava activity IDs
    const { data: runs, error: runsError } = await supabase
      .from('runs')
      .select('id, strava_activity_id')
      .eq('user_id', user.id)
      .not('strava_activity_id', 'is', null)

    if (runsError) {
      return new Response(
        JSON.stringify({ error: 'Failed to fetch runs' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!runs || runs.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No Strava-linked runs found', updated: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Refreshing ${runs.length} Strava-linked runs...`)

    let successCount = 0
    let errorCount = 0
    const errors: any[] = []

    // Process each run
    for (const run of runs) {
      try {
        console.log(`Refreshing run ${run.id} (Strava ID: ${run.strava_activity_id})...`)

        // Fetch activity details from Strava
        const activityResponse = await fetch(
          `https://www.strava.com/api/v3/activities/${run.strava_activity_id}`,
          {
            headers: { Authorization: `Bearer ${accessToken}` },
          }
        )

        if (!activityResponse.ok) {
          errorCount++
          errors.push({ runId: run.id, error: 'Failed to fetch activity from Strava' })
          continue
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
        const duration =
          hours > 0
            ? `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
            : `${minutes}:${secs.toString().padStart(2, '0')}`

        // Update the run with Strava data (no streams - just basic data)
        const { error: updateError } = await supabase
          .from('runs')
          .update({
            actual_distance: parseFloat(distanceKm.toFixed(2)),
            actual_time: duration,
            actual_pace: pace,
            completed: true,
            average_hr: activity.average_heartrate ? Math.round(activity.average_heartrate) : null,
            max_hr: activity.max_heartrate ? Math.round(activity.max_heartrate) : null,
            elevation_gain: activity.total_elevation_gain ? parseFloat(activity.total_elevation_gain.toFixed(1)) : null,
            average_cadence: activity.average_cadence ? parseFloat(activity.average_cadence.toFixed(1)) : null,
            average_watts: activity.average_watts ? parseFloat(activity.average_watts.toFixed(1)) : null,
            calories: activity.calories ? Math.round(activity.calories) : null,
            suffer_score: activity.suffer_score ? Math.round(activity.suffer_score) : null,
            moving_time: activity.moving_time ? Math.round(activity.moving_time) : null,
            elapsed_time: activity.elapsed_time ? Math.round(activity.elapsed_time) : null,
            average_speed: activity.average_speed ? parseFloat(activity.average_speed.toFixed(2)) : null,
            max_speed: activity.max_speed ? parseFloat(activity.max_speed.toFixed(2)) : null,
            strava_description: activity.description || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', run.id)
          .eq('user_id', user.id)

        if (updateError) {
          errorCount++
          errors.push({ runId: run.id, error: updateError.message })
          console.error(`Failed to update run ${run.id}:`, updateError)
          continue
        }

        successCount++
        console.log(`Successfully refreshed run ${run.id}`)

        // Small delay to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 200))
      } catch (error) {
        errorCount++
        errors.push({ runId: run.id, error: String(error) })
        console.error(`Error processing run ${run.id}:`, error)
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Refreshed ${successCount} of ${runs.length} runs`,
        total: runs.length,
        updated: successCount,
        failed: errorCount,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error refreshing all runs:', error)
    return new Response(
      JSON.stringify({ error: 'Failed to refresh runs', details: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

