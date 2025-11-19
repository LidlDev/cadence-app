import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { syncStravaActivity } from '@/lib/strava/activity-sync'
import { updateBestPerformances } from '@/lib/utils/update-best-performances'

/**
 * Link a specific Strava activity to a run
 * Fetches full activity data including streams and updates the run
 */
export async function POST(request: NextRequest) {
  try {
    const { runId, stravaActivityId } = await request.json()

    if (!runId || !stravaActivityId) {
      return NextResponse.json(
        { error: 'Missing runId or stravaActivityId' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's Strava tokens
    const { data: tokenData, error: tokenError } = await supabase
      .from('strava_tokens')
      .select('access_token, refresh_token, expires_at')
      .eq('user_id', user.id)
      .single()

    if (tokenError || !tokenData) {
      return NextResponse.json(
        { error: 'Strava not connected' },
        { status: 400 }
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
          client_id: process.env.NEXT_PUBLIC_STRAVA_CLIENT_ID,
          client_secret: process.env.STRAVA_CLIENT_SECRET,
          grant_type: 'refresh_token',
          refresh_token: tokenData.refresh_token,
        }),
      })

      if (!refreshResponse.ok) {
        const errorText = await refreshResponse.text()
        console.error('Token refresh failed:', errorText)
        return NextResponse.json(
          { error: 'Failed to refresh Strava token. Please reconnect your Strava account.' },
          { status: 401 }
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

    // Fetch detailed activity data
    const activityResponse = await fetch(
      `https://www.strava.com/api/v3/activities/${stravaActivityId}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    )

    if (!activityResponse.ok) {
      return NextResponse.json({ error: 'Failed to fetch activity details' }, { status: 500 })
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
    const duration = hours > 0
      ? `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
      : `${minutes}:${secs.toString().padStart(2, '0')}`

    // Sync the activity streams using the existing sync function
    // Pass runId so streams are linked immediately
    const result = await syncStravaActivity(stravaActivityId, user.id, accessToken, runId)

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    // Get the full activity data from the sync result
    const fullActivity = result.activity || activity

    // Update the run with ALL the detailed Strava data
    // Convert all numeric values to appropriate types
    const { error: updateError } = await supabase
      .from('runs')
      .update({
        strava_activity_id: stravaActivityId,
        actual_distance: parseFloat(distanceKm.toFixed(2)),
        actual_time: duration,
        actual_pace: pace,
        completed: true,
        // Heart rate - convert to integers
        average_hr: fullActivity.average_heartrate ? Math.round(fullActivity.average_heartrate) : null,
        max_hr: fullActivity.max_heartrate ? Math.round(fullActivity.max_heartrate) : null,
        // Elevation
        elevation_gain: fullActivity.total_elevation_gain ? parseFloat(fullActivity.total_elevation_gain.toFixed(1)) : null,
        elevation_loss: fullActivity.total_elevation_loss ? parseFloat(fullActivity.total_elevation_loss.toFixed(1)) : null,
        // Cadence
        average_cadence: fullActivity.average_cadence ? parseFloat(fullActivity.average_cadence.toFixed(1)) : null,
        max_cadence: fullActivity.max_cadence ? parseFloat(fullActivity.max_cadence.toFixed(1)) : null,
        // Power
        average_watts: fullActivity.average_watts ? parseFloat(fullActivity.average_watts.toFixed(1)) : null,
        max_watts: fullActivity.max_watts ? parseFloat(fullActivity.max_watts.toFixed(1)) : null,
        // Calories - convert to integer
        calories: fullActivity.calories ? Math.round(fullActivity.calories) : null,
        // Temperature
        average_temp: fullActivity.average_temp ? parseFloat(fullActivity.average_temp.toFixed(1)) : null,
        // Suffer score - convert to integer
        suffer_score: fullActivity.suffer_score ? Math.round(fullActivity.suffer_score) : null,
        // Time - convert to integers
        moving_time: fullActivity.moving_time ? Math.round(fullActivity.moving_time) : null,
        elapsed_time: fullActivity.elapsed_time ? Math.round(fullActivity.elapsed_time) : null,
        // Achievement data - convert to integers
        achievement_count: fullActivity.achievement_count ? Math.round(fullActivity.achievement_count) : null,
        pr_count: fullActivity.pr_count ? Math.round(fullActivity.pr_count) : null,
        kudos_count: fullActivity.kudos_count ? Math.round(fullActivity.kudos_count) : null,
        comment_count: fullActivity.comment_count ? Math.round(fullActivity.comment_count) : null,
        // Perceived exertion
        perceived_exertion: fullActivity.perceived_exertion ? parseFloat(fullActivity.perceived_exertion.toFixed(1)) : null,
        // Device
        device_name: fullActivity.device_name || null,
        // Gear
        gear_id: fullActivity.gear_id || null,
        // Speed
        average_speed: fullActivity.average_speed ? parseFloat(fullActivity.average_speed.toFixed(2)) : null,
        max_speed: fullActivity.max_speed ? parseFloat(fullActivity.max_speed.toFixed(2)) : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', runId)
      .eq('user_id', user.id)

    if (updateError) {
      console.error('Error updating run:', updateError)
      return NextResponse.json({ error: 'Failed to update run' }, { status: 500 })
    }

    // Streams and HR zones are already linked via syncStravaActivity
    // Now update the has_* boolean fields based on what streams exist
    const { data: runStreams } = await supabase
      .from('activity_streams')
      .select('stream_type')
      .eq('run_id', runId)

    const streamTypes = new Set(runStreams?.map((s) => s.stream_type) || [])

    await supabase
      .from('runs')
      .update({
        has_heartrate: streamTypes.has('heartrate'),
        has_cadence: streamTypes.has('cadence'),
        has_power: streamTypes.has('watts'),
        has_gps: streamTypes.has('latlng'),
        has_time_stream: streamTypes.has('time'),
        has_distance_stream: streamTypes.has('distance'),
        has_latlng_stream: streamTypes.has('latlng'),
        has_altitude_stream: streamTypes.has('altitude'),
        has_velocity_stream: streamTypes.has('velocity_smooth'),
        has_grade_stream: streamTypes.has('grade_smooth'),
        has_temp_stream: streamTypes.has('temp'),
      })
      .eq('id', runId)

    // Update best performances
    const distance = parseFloat(distanceKm.toFixed(2))
    await updateBestPerformances(
      supabase,
      user.id,
      runId,
      distance,
      duration,
      pace,
      new Date().toISOString().split('T')[0]
    )

    return NextResponse.json({
      success: true,
      message: 'Successfully linked Strava activity',
    })
  } catch (error) {
    console.error('Error linking Strava activity:', error)
    return NextResponse.json({ error: 'Failed to link activity' }, { status: 500 })
  }
}

