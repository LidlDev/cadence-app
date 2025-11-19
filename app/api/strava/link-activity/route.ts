import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { syncStravaActivity } from '@/lib/strava/activity-sync'

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
    const now = Math.floor(Date.now() / 1000)
    let accessToken = tokenData.access_token

    if (tokenData.expires_at && tokenData.expires_at < now) {
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

      const refreshData = await refreshResponse.json()
      accessToken = refreshData.access_token

      // Update tokens in database
      await supabase
        .from('strava_tokens')
        .update({
          access_token: refreshData.access_token,
          refresh_token: refreshData.refresh_token,
          expires_at: refreshData.expires_at,
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
    const result = await syncStravaActivity(stravaActivityId, user.id, accessToken)

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    // Update the run with the synced data
    const { error: updateError } = await supabase
      .from('runs')
      .update({
        strava_activity_id: stravaActivityId,
        actual_distance: parseFloat(distanceKm.toFixed(2)),
        actual_time: duration,
        actual_pace: pace,
        average_hr: activity.average_heartrate,
        max_hr: activity.max_heartrate,
        average_cadence: activity.average_cadence,
        elev_high: activity.elev_high,
        elev_low: activity.elev_low,
        total_elevation_gain: activity.total_elevation_gain,
        suffer_score: activity.suffer_score,
        has_heartrate: activity.has_heartrate,
        has_cadence: !!activity.average_cadence,
        calories: activity.calories,
        strava_synced: true,
        completed: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', runId)
      .eq('user_id', user.id)

    if (updateError) {
      console.error('Error updating run:', updateError)
      return NextResponse.json({ error: 'Failed to update run' }, { status: 500 })
    }

    // Update the activity_streams to link to this run
    await supabase
      .from('activity_streams')
      .update({ run_id: runId })
      .eq('user_id', user.id)
      .is('run_id', null)
      .order('created_at', { ascending: false })
      .limit(20) // Update the most recent streams (should be from this activity)

    return NextResponse.json({
      success: true,
      message: 'Successfully linked Strava activity',
    })
  } catch (error) {
    console.error('Error linking Strava activity:', error)
    return NextResponse.json({ error: 'Failed to link activity' }, { status: 500 })
  }
}

